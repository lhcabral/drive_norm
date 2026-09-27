import secrets
import string

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def generate_password(length: int = 8) -> str:
    alphabet = "".join(c for c in string.ascii_letters + string.digits if c not in "lIO0o1")
    return "".join(secrets.choice(alphabet) for _ in range(length))


def password_reset_link(user) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL.rstrip('/')}/redefinir-senha?uid={uid}&token={token}"


def send_password_reset_email(user) -> None:
    hours = settings.PASSWORD_RESET_TIMEOUT // 3600
    send_mail(
        subject="Drive Norm — redefinição de senha",
        message=(
            f"Olá, {user.display_name}!\n\n"
            "Recebemos um pedido para redefinir a senha da sua conta Drive Norm "
            f"(usuário: {user.username}).\n\n"
            f"Para criar uma nova senha, acesse o link abaixo (válido por {hours} hora(s)):\n"
            f"{password_reset_link(user)}\n\n"
            "Se você não fez esse pedido, ignore este e-mail."
        ),
        from_email=None,
        recipient_list=[user.email],
    )
