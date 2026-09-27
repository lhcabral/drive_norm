from django.utils import timezone

from celery import shared_task

from accounts.notifications import notify_user

from .models import RideProposal


@shared_task
def expire_pending_proposals():
    now = timezone.now()
    qs = RideProposal.objects.filter(
        status=RideProposal.Status.PENDING, expires_at__lte=now
    )
    count = 0
    for proposal in qs:
        proposal.status = RideProposal.Status.EXPIRED
        proposal.responded_at = now
        proposal.save(update_fields=["status", "responded_at"])
        notify_user(
            proposal.driver_id,
            {"type": "proposal_expired", "proposal_id": proposal.id},
        )
        notify_user(
            proposal.client_id,
            {"type": "proposal_expired", "proposal_id": proposal.id},
        )
        count += 1
    return count
