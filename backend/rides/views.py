from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ClientProfile
from accounts.notifications import notify_user
from wallet.models import InsufficientBalance, Wallet

from .models import Ride, RideProposal, RideService
from .serializers import (
    RideProposalCreateSerializer,
    RideProposalSerializer,
    RideSerializer,
)

User = get_user_model()


def expire_stale_proposals():
    """Expira propostas vencidas sem depender do Celery (útil em dev)."""
    from rides.tasks import expire_pending_proposals

    expire_pending_proposals()


class RideProposalListCreateView(APIView):
    def get(self, request):
        expire_stale_proposals()
        user = request.user
        if user.role == User.Role.CLIENT:
            qs = RideProposal.objects.filter(client=user).select_related(
                "client", "driver", "client__client_profile"
            )
        elif user.role == User.Role.DRIVER:
            qs = RideProposal.objects.filter(driver=user).select_related(
                "client", "driver", "client__client_profile"
            )
        else:
            qs = RideProposal.objects.all().select_related(
                "client", "driver", "client__client_profile"
            )
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(RideProposalSerializer(qs[:50], many=True).data)

    def post(self, request):
        if request.user.role != User.Role.DRIVER and not request.user.is_staff:
            return Response(
                {"detail": "Apenas motoristas podem criar propostas."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = RideProposalCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["client_code"].strip().upper()
        amount = Decimal(serializer.validated_data["amount"])

        try:
            profile = ClientProfile.objects.select_related("user", "user__wallet").get(
                code=code
            )
        except ClientProfile.DoesNotExist:
            return Response(
                {"detail": "Cliente não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        client = profile.user
        wallet, _ = Wallet.objects.get_or_create(user=client)
        if wallet.balance < amount:
            return Response(
                {
                    "detail": "Saldo insuficiente do cliente.",
                    "balance": str(wallet.balance),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending = RideProposal.objects.filter(
            client=client, status=RideProposal.Status.PENDING
        ).exists()
        if pending:
            return Response(
                {"detail": "Cliente já possui uma proposta pendente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expires_at = timezone.now() + timedelta(seconds=settings.PROPOSAL_TIMEOUT_SECONDS)
        proposal = RideProposal.objects.create(
            client=client,
            driver=request.user,
            amount=amount,
            expires_at=expires_at,
        )

        payload = RideProposalSerializer(proposal).data
        notify_user(
            client.id,
            {"type": "ride_proposal", "proposal": payload},
        )
        return Response(payload, status=status.HTTP_201_CREATED)


class RideProposalAcceptView(APIView):
    def post(self, request, pk):
        expire_stale_proposals()
        try:
            proposal = RideProposal.objects.get(pk=pk)
        except RideProposal.DoesNotExist:
            return Response({"detail": "Proposta não encontrada."}, status=404)

        try:
            ride = RideService.accept(proposal, request.user)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except InsufficientBalance:
            return Response(
                {"detail": "Saldo insuficiente."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(RideSerializer(ride).data)


class RideProposalRejectView(APIView):
    def post(self, request, pk):
        try:
            proposal = RideProposal.objects.get(pk=pk)
        except RideProposal.DoesNotExist:
            return Response({"detail": "Proposta não encontrada."}, status=404)

        try:
            proposal = RideService.reject(proposal, request.user)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(RideProposalSerializer(proposal).data)


class RideListView(APIView):
    def get(self, request):
        user = request.user
        if user.role == User.Role.CLIENT:
            qs = Ride.objects.filter(client=user)
        elif user.role == User.Role.DRIVER:
            qs = Ride.objects.filter(driver=user)
        else:
            qs = Ride.objects.all()
        qs = qs.select_related("client", "driver", "client__client_profile")[:50]
        return Response(RideSerializer(qs, many=True).data)
