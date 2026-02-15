from datetime import date
import uuid

from flask import Flask, render_template, redirect, url_for, request, session
from flask_login import (
    UserMixin, login_user, LoginManager,
    login_required, current_user, logout_user
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.orm import relationship
from sqlalchemy import Integer, String, Date, ForeignKey, Float

from form import LoginForm, register_form

# -------------------------------------------------
# APP CONFIG
# -------------------------------------------------

app = Flask(__name__)
app.config["SECRET_KEY"] = "fixed-secret-key"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///splitstack.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# -------------------------------------------------
# EXTENSIONS
# -------------------------------------------------

db = SQLAlchemy(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

# -------------------------------------------------
# MODELS
# -------------------------------------------------

class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(Integer, primary_key=True)
    name = db.Column(String(100), nullable=False)
    email = db.Column(String(100), unique=True, nullable=False)
    password = db.Column(String(200), nullable=False)

class Group(db.Model):
    __tablename__ = "groups"
    id = db.Column(Integer, primary_key=True)
    name = db.Column(String(100), nullable=False)
    description = db.Column(String(200), nullable=False)

    invite_code = db.Column(
        String(12),
        unique=True,
        nullable=False,
        default=lambda: uuid.uuid4().hex[:12]
    )

    created_by = db.Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = db.Column(Date, default=date.today)

    creator = relationship("User", backref="groups_created")

class GroupMember(db.Model):
    __tablename__ = "group_members"
    id = db.Column(Integer, primary_key=True)
    user_id = db.Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = db.Column(Integer, ForeignKey("groups.id"), nullable=False)

class Expense(db.Model):
    __tablename__ = "expenses"
    id = db.Column(Integer, primary_key=True)

    group_id = db.Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = db.Column(Integer, ForeignKey("users.id"), nullable=False)

    amount = db.Column(Float, nullable=False)
    description = db.Column(String(200), nullable=False)

    created_at = db.Column(Date, default=date.today)

    user = relationship("User")
    group = relationship("Group")

# -------------------------------------------------
# LOGIN LOADER
# -------------------------------------------------

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# -------------------------------------------------
# CREATE TABLES
# -------------------------------------------------

with app.app_context():
    db.create_all()

# -------------------------------------------------
# HELPER FUNCTIONS
# -------------------------------------------------

def calculate_balances(group_id):
    members = (
        db.session.query(User)
        .join(GroupMember)
        .filter(GroupMember.group_id == group_id)
        .all()
    )

    expenses = (
        db.session.query(Expense)
        .filter(Expense.group_id == group_id)
        .all()
    )

    total = sum(e.amount for e in expenses)
    share = round(total / len(members), 2) if members else 0

    paid = {m.id: 0 for m in members}
    for e in expenses:
        paid[e.user_id] += e.amount

    balances = {}
    for m in members:
        balances[m.id] = round(paid[m.id] - share, 2)

    return members, balances


def settle_balances(members, balances):
    debtors = []
    creditors = []

    for m in members:
        bal = balances[m.id]
        if bal < 0:
            debtors.append([m, -bal])
        elif bal > 0:
            creditors.append([m, bal])

    settlements = []
    i = j = 0

    while i < len(debtors) and j < len(creditors):
        debtor, d_amt = debtors[i]
        creditor, c_amt = creditors[j]

        pay = min(d_amt, c_amt)
        settlements.append({
            "from": debtor.name,
            "to": creditor.name,
            "amount": round(pay, 2)
        })

        debtors[i][1] -= pay
        creditors[j][1] -= pay

        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1

    return settlements

# -------------------------------------------------
# ROUTES
# -------------------------------------------------

@app.route("/")
def home():
    # return redirect(url_for('groups'))
    return render_template('index.html')

# ---------------- REGISTER ----------------

@app.route("/register_page", methods=["GET", "POST"])
def register():
    form = register_form()

    if form.validate_on_submit():
        if db.session.scalar(db.select(User).where(User.email == form.email.data)):
            return redirect(url_for("login"))

        user = User(
            name=form.name.data,
            email=form.email.data,
            password=generate_password_hash(form.password.data)
        )
        db.session.add(user)
        db.session.commit()

        login_user(user)
        return redirect(url_for("groups"))

    return render_template("register.html", form=form)

# ---------------- LOGIN ----------------

@app.route("/login_page", methods=["GET", "POST"])
def login():
    form = LoginForm()

    if form.validate_on_submit():
        user = db.session.scalar(
            db.select(User).where(User.email == form.email.data)
        )

        if user and check_password_hash(user.password, form.password.data):
            login_user(user)

            pending = session.pop("pending_invite", None)
            if pending:
                return redirect(url_for("join_group", invite_code=pending))

            return redirect(url_for("groups"))

        return redirect(url_for("login"))

    return render_template("login.html", form=form)

# ---------------- LOGOUT ----------------

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))

# ---------------- GROUP LIST ----------------

@app.route("/groups")
@login_required
def groups():
    groups = (
        db.session.query(Group)
        .join(GroupMember)
        .filter(GroupMember.user_id == current_user.id)
        .all()
    )
    return render_template("make_grp.html", groups=groups)

# ---------------- CREATE GROUP ----------------

@app.route("/create_group", methods=["GET", "POST"])
@login_required
def create_group():
    if request.method == "POST":
        group = Group(
            name=request.form["group_name"],
            description=request.form["description"],
            created_by=current_user.id
        )
        db.session.add(group)
        db.session.commit()

        db.session.add(GroupMember(
            user_id=current_user.id,
            group_id=group.id
        ))
        db.session.commit()

        return redirect(url_for("group_page", group_id=group.id))

    return render_template("create_grp.html")

# ---------------- JOIN GROUP ----------------

@app.route("/join/<invite_code>")
def join_group(invite_code):

    if not current_user.is_authenticated:
        session["pending_invite"] = invite_code
        return redirect(url_for("login"))

    group = db.session.scalar(
        db.select(Group).where(Group.invite_code == invite_code)
    )

    if not group:
        return redirect(url_for("groups"))

    exists = db.session.scalar(
        db.select(GroupMember).where(
            GroupMember.user_id == current_user.id,
            GroupMember.group_id == group.id
        )
    )

    if not exists:
        db.session.add(GroupMember(
            user_id=current_user.id,
            group_id=group.id
        ))
        db.session.commit()

    return redirect(url_for("group_page", group_id=group.id))

# ---------------- GROUP PAGE ----------------

@app.route("/group/<int:group_id>")
@login_required
def group_page(group_id):

    member = db.session.scalar(
        db.select(GroupMember).where(
            GroupMember.user_id == current_user.id,
            GroupMember.group_id == group_id
        )
    )

    if not member:
        return redirect(url_for("groups"))

    group = db.session.get(Group, group_id)

    expenses = (
        db.session.query(Expense)
        .filter(Expense.group_id == group_id)
        .order_by(Expense.id.asc())
        .all()
    )

    return render_template("group.html", group=group, expenses=expenses)

# ---------------- ADD EXPENSE ----------------

@app.route("/group/<int:group_id>/add_expense", methods=["POST"])
@login_required
def add_expense(group_id):

    member = db.session.scalar(
        db.select(GroupMember).where(
            GroupMember.user_id == current_user.id,
            GroupMember.group_id == group_id
        )
    )

    if not member:
        return redirect(url_for("groups"))

    amount = float(request.form.get("money"))
    description = request.form.get("place")

    db.session.add(Expense(
        group_id=group_id,
        user_id=current_user.id,
        amount=amount,
        description=description
    ))
    db.session.commit()

    return redirect(url_for("group_page", group_id=group_id))

# ---------------- BALANCES PAGE ----------------

@app.route("/group/<int:group_id>/balances")
@login_required
def balances_page(group_id):

    members, balances = calculate_balances(group_id)
    settlements = settle_balances(members, balances)

    return render_template(
        "balances.html",
        members=members,
        balances=balances,
        settlements=settlements
    )

# -------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)
