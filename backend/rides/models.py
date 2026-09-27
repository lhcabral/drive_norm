from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class RideProposal(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        ACCEPTED = "accepted", "Aceita"
        REJECTED = "rejected", "Recusada"
        EXPIRED = "expired", "Expirada"
        CANCELLED = "cancelled", "Cancelada"

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ride_proposals_as_client",
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ride_proposals_as_driver",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Proposta #{self.pk} {self.amount} ({self.status})"

    @property
    def is_expired(self):
        return self.status == self.Status.PENDING and timezone.now() >= self.expires_at


class Ride(models.Model):
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rides_as_client",
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rides_as_driver",
    )
    proposal = models.OneToOneField(
        RideProposal, on_delete=models.PROTECT, related_name="ride"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Corrida #{self.pk} R$ {self.amount}"


class RideService:
    @staticmethod
    @transaction.atomic
    def accept(proposal: RideProposal, client) -> Ride:
        from wallet.models import InsufficientBalance, LedgerEntry, Wallet, WalletService
        from accounts.notifications import notify_user

        proposal = RideProposal.objects.select_for_update().get(pk=proposal.pk)

        if proposal.client_id != client.id:
            raise PermissionError("Proposta não pertence a este cliente.")

        if proposal.status == RideProposal.Status.ACCEPTED and hasattr(proposal, "ride"):
            return proposal.ride

        if proposal.status != RideProposal.Status.PENDING:
            raise ValueError("Proposta não está pendente.")

        if timezone.now() >= proposal.expires_at:
            proposal.status = RideProposal.Status.EXPIRED
            proposal.responded_at = timezone.now()
            proposal.save(update_fields=["status", "responded_at"])
            notify_user(
                proposal.driver_id,
                {
                    "type": "proposal_expired",
                    "proposal_id": proposal.id,
                },
            )
            raise ValueError("Proposta expirada.")

        wallet, _ = Wallet.objects.get_or_create(user=client)
        ride = Ride.objects.create(
            client=client,
            driver=proposal.driver,
            proposal=proposal,
            amount=proposal.amount,
        )

        try:
            entry = WalletService.apply(
                wallet=wallet,
                amount=-Decimal(proposal.amount),
                entry_type=LedgerEntry.EntryType.DEBIT_RIDE,
                description=f"Corrida #{ride.pk} com motorista {proposal.driver.display_name}",
                created_by=client,
                ride=ride,
                idempotency_key=f"ride-accept-{proposal.pk}",
            )
        except InsufficientBalance:
            ride.delete()
            raise

        proposal.status = RideProposal.Status.ACCEPTED
        proposal.responded_at = timezone.now()
        proposal.save(update_fields=["status", "responded_at"])

        notify_user(
            proposal.driver_id,
            {
                "type": "proposal_accepted",
                "proposal_id": proposal.id,
                "ride_id": ride.id,
                "amount": str(proposal.amount),
                "client_name": client.display_name,
                "balance_after": str(entry.balance_after),
            },
        )
        notify_user(
            client.id,
            {
                "type": "ride_debited",
                "ride_id": ride.id,
                "amount": str(proposal.amount),
                "balance": str(entry.balance_after),
            },
        )
        return ride

    @staticmethod
    @transaction.atomic
    def reject(proposal: RideProposal, client) -> RideProposal:
        from accounts.notifications import notify_user

        proposal = RideProposal.objects.select_for_update().get(pk=proposal.pk)
        if proposal.client_id != client.id:
            raise PermissionError("Proposta não pertence a este cliente.")
        if proposal.status != RideProposal.Status.PENDING:
            raise ValueError("Proposta não está pendente.")

        proposal.status = RideProposal.Status.REJECTED
        proposal.responded_at = timezone.now()
        proposal.save(update_fields=["status", "responded_at"])

        notify_user(
            proposal.driver_id,
            {
                "type": "proposal_rejected",
                "proposal_id": proposal.id,
                "client_name": client.display_name,
            },
        )
        return proposal
