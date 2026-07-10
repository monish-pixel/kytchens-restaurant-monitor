"""Send alert emails via Gmail SMTP (same credentials as expense-manager)."""
import os
import smtplib
from email.mime.text import MIMEText


def send_gmail(subject: str, body: str) -> bool:
    sender = os.environ.get("GMAIL_SENDER_EMAIL")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    if not sender or not password:
        print("[GMAIL] GMAIL_SENDER_EMAIL or GMAIL_APP_PASSWORD not set — skipping email")
        return False

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = f"Kytchens Fleet <{sender}>"
    msg["To"] = sender  # always send to self

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(sender, password)
            smtp.sendmail(sender, [sender], msg.as_string())
        print(f"[GMAIL] Sent: {subject}")
        return True
    except Exception as e:
        print(f"[GMAIL] Failed to send email: {e}")
        return False
