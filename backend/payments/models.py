import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        APPROVED = "approved", "Aprovado"
        REJECTED = "rejected", "Rejeitado"
        CANCELLED = "cancelled", "Cancelado"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    provider = models.CharField(max_length=40, default="mercadopago")
    external_id = models.CharField(max_length=120, blank=True, null=True, unique=True)
    qr_code = models.TextField(blank=True)
    qr_code_base64 = models.TextField(blank=True)
    ticket_url = models.URLField(blank=True)
    idempotency_key = models.CharField(max_length=64, unique=True)
    credited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payment {self.pk} {self.amount} ({self.status})"


class PaymentSettings(models.Model):
    """Registro único com a integração PIX configurada pelo admin no painel."""

    mercadopago_access_token = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name = "Configuração do PIX"
        verbose_name_plural = "Configuração do PIX"

    def __str__(self):
        return "Configuração do PIX"

    @classmethod
    def load(cls) -> "PaymentSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


def mercadopago_token() -> str:
    """Token do painel; se vazio, o do .env."""
    return PaymentSettings.load().mercadopago_access_token or settings.MERCADOPAGO_ACCESS_TOKEN


def pix_mode() -> str:
    if mercadopago_token():
        return "mercadopago"
    return "simulated" if settings.DEBUG else "disabled"


class PixNotConfigured(Exception):
    pass


class PaymentService:
    @staticmethod
    def create_pix(user, amount: Decimal) -> Payment:
        from .mercadopago_client import create_pix_charge

        amount = Decimal(amount).quantize(Decimal("0.01"))
        idempotency_key = str(uuid.uuid4())
        payment = Payment.objects.create(
            user=user,
            amount=amount,
            idempotency_key=idempotency_key,
        )
        result = create_pix_charge(payment)
        payment.external_id = result["external_id"]
        payment.qr_code = result.get("qr_code", "")
        payment.qr_code_base64 = result.get("qr_code_base64", "")
        payment.ticket_url = result.get("ticket_url", "")
        payment.save(
            update_fields=[
                "external_id",
                "qr_code",
                "qr_code_base64",
                "ticket_url",
                "updated_at",
            ]
        )
        return payment

    @staticmethod
    def sync_status(payment: Payment) -> Payment:
        """Consulta o Mercado Pago e credita a carteira se o PIX foi pago."""
        from .mercadopago_client import fetch_payment_status

        if payment.credited or not payment.external_id:
            return payment
        mp_status = fetch_payment_status(payment.external_id)
        if mp_status == "approved":
            return PaymentService.mark_approved(payment)
        if mp_status in ("rejected", "cancelled"):
            payment.status = (
                Payment.Status.REJECTED if mp_status == "rejected" else Payment.Status.CANCELLED
            )
            payment.save(update_fields=["status", "updated_at"])
        return payment

    @staticmethod
    @transaction.atomic
    def mark_approved(payment: Payment) -> Payment:
        from accounts.notifications import notify_user
        from wallet.models import LedgerEntry, Wallet, WalletService

        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if payment.credited:
            return payment

        payment.status = Payment.Status.APPROVED
        payment.paid_at = timezone.now()
        payment.credited = True
        payment.save(update_fields=["status", "paid_at", "credited", "updated_at"])

        wallet, _ = Wallet.objects.get_or_create(user=payment.user)
        entry = WalletService.apply(
            wallet=wallet,
            amount=Decimal(payment.amount),
            entry_type=LedgerEntry.EntryType.CREDIT_PIX,
            description=f"Recarga PIX #{payment.pk}",
            payment=payment,
            idempotency_key=f"pix-{payment.external_id or payment.pk}",
        )
        notify_user(
            payment.user_id,
            {
                "type": "pix_approved",
                "payment_id": payment.id,
                "amount": str(payment.amount),
                "balance": str(entry.balance_after),
            },
        )
        return payment
