"""Simple frontend governance table from HL-SEC-DEVBRIEF-2026-001."""
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

BROWN = "50381F"
CREAM = "F7F4EF"
SURFACE = "ECE6D9"
WHITE = "FFFFFF"
TEXT = "1E1A16"
MUTED = "6B645B"
GREEN = "E8F5E9"
AMBER = "FFF8E1"
RED = "FFEBEE"

header_fill = PatternFill("solid", fgColor=BROWN)
header_font = Font(name="Calibri", bold=True, color=WHITE, size=12)
title_font = Font(name="Calibri", bold=True, color=BROWN, size=18)
sub_font = Font(name="Calibri", italic=True, color=MUTED, size=11)
body = Font(name="Calibri", color=TEXT, size=11)
bold = Font(name="Calibri", bold=True, color=TEXT, size=11)
done_f = PatternFill("solid", fgColor=GREEN)
part_f = PatternFill("solid", fgColor=AMBER)
open_f = PatternFill("solid", fgColor=RED)
cream = PatternFill("solid", fgColor=CREAM)
white_f = PatternFill("solid", fgColor=WHITE)
surface = PatternFill("solid", fgColor=SURFACE)
thin = Border(
    left=Side(style="thin", color="E7DFC8"),
    right=Side(style="thin", color="E7DFC8"),
    top=Side(style="thin", color="E7DFC8"),
    bottom=Side(style="thin", color="E7DFC8"),
)
wrap = Alignment(wrap_text=True, vertical="center")
center = Alignment(wrap_text=True, vertical="center", horizontal="center")


def status_fill(val: str):
    v = (val or "").lower()
    if v == "done":
        return done_f
    if v == "partial":
        return part_f
    return open_f


def build():
    wb = Workbook()
    ws = wb.active
    ws.title = "Frontend Security Table"

    ws.merge_cells("A1:E1")
    ws["A1"] = "Voicera Frontend — Security & Compliance Table"
    ws["A1"].font = title_font

    ws.merge_cells("A2:E2")
    ws["A2"] = (
        f"Based on HL-SEC-DEVBRIEF-2026-001  |  Frontend only  |  {date.today().strftime('%d %b %Y')}  |  Confidential — Internal"
    )
    ws["A2"].font = sub_font

    ws.merge_cells("A3:E3")
    ws["A3"] = (
        "Brief stack is Clerk / Supabase / FastAPI / Azure. Voicera frontend uses React + Firebase Auth + Firestore + Vercel. "
        "This table shows what the frontend team must follow, in simple words."
    )
    ws["A3"].font = bold
    ws["A3"].fill = surface
    ws["A3"].alignment = wrap
    ws.row_dimensions[3].height = 40

    headers = [
        "#",
        "Governance topic (from brief)",
        "What frontend must do",
        "Status",
        "Simple note",
    ]
    for i, h in enumerate(headers, 1):
        ws.cell(5, i, h)
        ws.cell(5, i).fill = header_fill
        ws.cell(5, i).font = header_font
        ws.cell(5, i).alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        ws.cell(5, i).border = thin
    ws.row_dimensions[5].height = 30

    rows = [
        [
            1,
            "Login / Authentication (JWT)",
            "User signs in on the login page. Every API call sends the Firebase token. Do not store password in localStorage.",
            "Done",
            "Firebase Auth login. Token refresh is automatic. SSO/SAML not in frontend yet.",
        ],
        [
            2,
            "MFA (admin)",
            "Admin login should require extra verification (MFA) when Firebase MFA is enabled.",
            "Done",
            "TOTP enroll on Admin → Security. Login asks for authenticator code when MFA is on. Enable Identity Platform MFA in Firebase Console.",
        ],
        [
            3,
            "Tenant / User / Team management",
            "Show only the logged-in company workspace. Admin console only for platform admin. Do not let UI hide = security.",
            "Done",
            "RoleRoute: admin → /admin, customer → /dashboard. Suspended account is blocked.",
        ],
        [
            4,
            "Data security / isolation (RLS)",
            "Frontend must request only own org data. Never list all customers from a customer login. Isolation must also be in Firestore rules.",
            "Done",
            "Rules: customer reads own org only. Admin can list all. Must deploy rules to go live.",
        ],
        [
            5,
            "Ownership check (no ID guess)",
            "Do not trust a URL or org id from the user. Server / Firestore rules decide if they own it.",
            "Done",
            "Create account only via Cloud Function. No client-side user create.",
        ],
        [
            6,
            "Secrets never in frontend or git",
            "No API secret keys in React code. VITE_ Firebase keys are public by design. Real secrets stay in Vercel / Functions.",
            "Done",
            ".gitignore covers all .env files. .env.example has empty values.",
        ],
        [
            7,
            "HTTPS everywhere",
            "App must run on https in production. No http links for login or APIs.",
            "Done",
            "Vercel HTTPS + HSTS header.",
        ],
        [
            8,
            "Security headers (CSP, HSTS, X-Frame-Options)",
            "Frontend host must send browser protection headers so the app cannot be put in a fake iframe.",
            "Done",
            "Added in vercel.json. Needs Vercel redeploy.",
        ],
        [
            9,
            "Input validation / XSS",
            "Validate forms on screen (email, password length). Do not render untrusted HTML. Use React text, not innerHTML.",
            "Done",
            "Email + password policy on login/create. Names sanitised. React text only (no innerHTML).",
        ],
        [
            10,
            "Session management",
            "Logout must clear session. Remember-me uses local storage; otherwise session only. Token expires and refreshes.",
            "Done",
            "Logout clears storage + revokes refresh tokens. Security page can sign out other devices.",
        ],
        [
            11,
            "Audit logging",
            "Frontend should not be the source of truth. Sensitive actions (create account, suspend) should be logged on server.",
            "Done",
            "Cloud Function stamps audit_events. Admin Security page lists last 50. Client cannot write the collection.",
        ],
        [
            12,
            "Logging hygiene / no PII in logs",
            "Do not console.log passwords, tokens, or full customer PII.",
            "Done",
            "safeLog redacts emails/secrets. Admin pages use it instead of raw console.error.",
        ],
        [
            13,
            "Credits / usage analytics UI",
            "If we show usage, show only that company's numbers. No cross-company charts for customers.",
            "Done",
            "Customer Usage & credits page shows own org calls vs plan limit only.",
        ],
        [
            14,
            "Rate limiting",
            "Frontend cannot fully enforce this. Still: disable double-submit on login/create buttons.",
            "Done",
            "Client throttle on login / MFA / reset / create-account. Loading disables double-submit. IP limit remains backend.",
        ],
        [
            15,
            "Dependency / supply-chain (frontend)",
            "Keep npm packages updated. Do not add unknown UI libraries without review.",
            "Done",
            "Dependabot weekly for root + functions. Review PRs before merge.",
        ],
        [
            16,
            "Data deletion / offboarding UI",
            "Admin should have a clear way to close/delete a customer when policy requires it.",
            "Done",
            "Admin drawer: Offboard / delete account. Cloud Function deletes Auth user + org + audit.",
        ],
    ]

    for r, row in enumerate(rows, 6):
        for c, val in enumerate(row, 1):
            ws.cell(r, c, val)
            ws.cell(r, c).font = body
            ws.cell(r, c).alignment = wrap
            ws.cell(r, c).border = thin
            ws.cell(r, c).fill = cream if r % 2 == 0 else white_f
        ws.row_dimensions[r].height = 52
        ws.cell(r, 1).alignment = center
        ws.cell(r, 4).fill = status_fill(str(row[3]))
        ws.cell(r, 4).font = bold
        ws.cell(r, 4).alignment = center

    ws.merge_cells("A23:E23")
    ws["A23"] = "Frontend summary for manager"
    ws["A23"].font = Font(name="Calibri", bold=True, color=WHITE, size=12)
    ws["A23"].fill = header_fill
    ws["A23"].alignment = center

    summary = [
        [
            "Done on frontend",
            "Login + MFA step, role routing, tenant isolation, server-only account create/update/offboard, audit log UI, usage (own org), validation, safe logs, session revoke, Dependabot, HTTPS headers.",
        ],
        [
            "Partial",
            "None remaining on the frontend table. App Check / IP rate limit still sit on Firebase / backend.",
        ],
        [
            "Open (ops / console)",
            "Enable Identity Platform TOTP MFA in Firebase Console. Deploy rules + functions + Vercel.",
        ],
        [
            "Deploy still needed",
            "Firestore rules + Cloud Functions + Vercel redeploy + VITE_USE_MOCK=false. Until deploy, isolation is in code but not live.",
        ],
    ]
    for i, (k, v) in enumerate(summary, 24):
        ws.cell(i, 1, k).font = bold
        ws.cell(i, 1).fill = surface
        ws.cell(i, 1).alignment = wrap
        ws.cell(i, 1).border = thin
        ws.merge_cells(start_row=i, start_column=2, end_row=i, end_column=5)
        ws.cell(i, 2, v).font = body
        ws.cell(i, 2).alignment = wrap
        ws.cell(i, 2).border = thin
        ws.row_dimensions[i].height = 42
        for c in range(2, 6):
            ws.cell(i, c).border = thin

    ws.merge_cells("A29:E29")
    ws["A29"] = "Colour: Green = Done   |   Amber = Partial   |   Red = Open"
    ws["A29"].font = sub_font

    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 40
    ws.column_dimensions["C"].width = 58
    ws.column_dimensions["D"].width = 12
    ws.column_dimensions["E"].width = 48
    ws.freeze_panes = "A6"
    ws.auto_filter.ref = "A5:E21"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_margins.left = 0.4
    ws.page_margins.right = 0.4
    ws.oddFooter.center.text = "Voicera Frontend | HL-SEC-DEVBRIEF-2026-001 | Confidential"

    out = r"c:\karan\voicera\Voicera_Frontend_Security_Governance.xlsx"
    try:
        wb.save(out)
    except PermissionError:
        out = r"c:\karan\voicera\Voicera_Frontend_Security_Governance_Updated.xlsx"
        wb.save(out)
    print(out)


if __name__ == "__main__":
    build()
