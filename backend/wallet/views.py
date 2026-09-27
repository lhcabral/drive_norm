from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ClientProfile
from accounts.notifications import notify_user

from .models import LedgerEntry, Wallet, WalletService
from .serializers import LedgerEntrySerializer, ManualCreditSerializer, WalletSerializer

User = get_user_model()


class WalletView(APIView):
    def get(self, request):
        if request.user.role != User.Role.CLIENT:
            return Response(
                {"detail": "Apenas clientes possuem carteira."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        return Response(WalletSerializer(wallet).data)


class LedgerListView(APIView):
    def get(self, request):
        if request.user.role != User.Role.CLIENT:
            return Response(
                {"detail": "Apenas clientes possuem extrato."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        qs = wallet.entries.all()[:100]
        return Response(LedgerEntrySerializer(qs, many=True).data)


class ManualCreditView(APIView):
    def post(self, request):
        if request.user.role != User.Role.DRIVER and not request.user.is_staff:
            return Response(
                {"detail": "Apenas motoristas podem creditar."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ManualCreditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["client_code"].strip().upper()
        amount = serializer.validated_data["amount"]
        description = serializer.validated_data.get("description") or "Crédito lançado pelo motorista"

        try:
            profile = ClientProfile.objects.select_related("user").get(code=code)
        except ClientProfile.DoesNotExist:
            return Response(
                {"detail": "Cliente não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        wallet, _ = Wallet.objects.get_or_create(user=profile.user)
        entry = WalletService.apply(
            wallet=wallet,
            amount=Decimal(amount),
            entry_type=LedgerEntry.EntryType.CREDIT_MANUAL,
            description=description,
            created_by=request.user,
        )
        notify_user(
            profile.user_id,
            {
                "type": "wallet_credited",
                "amount": str(amount),
                "balance": str(entry.balance_after),
                "description": description,
            },
        )
        return Response(
            {
                "balance": str(entry.balance_after),
                "entry": LedgerEntrySerializer(entry).data,
            },
            status=status.HTTP_201_CREATED,
        )
