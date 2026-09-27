from datetime import datetime, time
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.notifications import notify_user
from accounts.passwords import generate_password, send_password_reset_email
from accounts.permissions import IsSiteAdmin
from payments.mercadopago_client import check_token
from payments.models import Payment, PaymentSettings, mercadopago_token, pix_mode
from rides.models import Ride
from rides.serializers import RideSerializer
from wallet.models import InsufficientBalance, LedgerEntry, Wallet, WalletService
from wallet.serializers import LedgerEntrySerializer

from .serializers import (
    AdminClientSerializer,
    AdminDriverSerializer,
    AdminPaymentSerializer,
    DriverCreateSerializer,
    PixSettingsSerializer,
    SetPasswordSerializer,
    WalletOperationSerializer,
)

User = get_user_model()


class AdminPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


def clients_queryset():
    return (
        User.objects.filter(role=User.Role.CLIENT)
        .select_related("client_profile", "wallet")
        .annotate(rides_count=Count("rides_as_client", distinct=True))
        .order_by("-date_joined")
    )


def drivers_queryset():
    return (
        User.objects.filter(role=User.Role.DRIVER)
        .select_related("driver_profile")
        .annotate(
            rides_count=Count("rides_as_driver", distinct=True),
            rides_total=Coalesce(
                Sum("rides_as_driver__amount"), Value(Decimal("0")), output_field=DecimalField()
            ),
        )
        .order_by("-date_joined")
    )


def search_filter(queryset, term: str, extra_fields=()):
    term = (term or "").strip()
    if not term:
        return queryset
    query = Q(full_name__icontains=term) | Q(username__icontains=term) | Q(phone__icontains=term)
    query |= Q(email__icontains=term)
    for field in extra_fields:
        query |= Q(**{f"{field}__icontains": term})
    return queryset.filter(query)


class SummaryView(APIView):
    permission_classes = [IsSiteAdmin]

    def get(self, request):
        start_of_day = timezone.make_aware(datetime.combine(timezone.localdate(), time.min))
        rides_today = Ride.objects.filter(created_at__gte=start_of_day).aggregate(
            count=Count("id"), total=Sum("amount")
        )
        return Response(
            {
                "clients": User.objects.filter(role=User.Role.CLIENT).count(),
                "drivers": User.objects.filter(role=User.Role.DRIVER, is_active=True).count(),
                "total_balance": str(
                    Wallet.objects.aggregate(total=Sum("balance"))["total"] or Decimal("0")
                ),
                "rides_today": rides_today["count"],
                "rides_today_total": str(rides_today["total"] or Decimal("0")),
                "pix_pending": Payment.objects.filter(status=Payment.Status.PENDING).count(),
                "pix_mode": pix_mode(),
            }
        )


class ClientListView(generics.ListAPIView):
    permission_classes = [IsSiteAdmin]
    serializer_class = AdminClientSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        return search_filter(
            clients_queryset(), self.request.query_params.get("search"), ["client_profile__code"]
        )


class ClientDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSiteAdmin]
    serializer_class = AdminClientSerializer
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        return clients_queryset()

    def retrieve(self, request, *args, **kwargs):
        client = self.get_object()
        wallet, _ = Wallet.objects.get_or_create(user=client)
        entries = wallet.entries.all()
        totals = entries.aggregate(
            credits=Sum("amount", filter=Q(amount__gt=0)),
            debits=Sum("amount", filter=Q(amount__lt=0)),
        )
        rides = Ride.objects.filter(client=client).select_related(
            "client", "driver", "client__client_profile"
        )
        return Response(
            {
                **self.get_serializer(client).data,
                "stats": {
                    "total_credits": str(totals["credits"] or Decimal("0")),
                    "total_spent": str(-(totals["debits"] or Decimal("0"))),
                    "rides_total": str(rides.aggregate(t=Sum("amount"))["t"] or Decimal("0")),
                },
                "ledger": LedgerEntrySerializer(entries[:100], many=True).data,
                "rides": RideSerializer(rides[:50], many=True).data,
                "payments": AdminPaymentSerializer(
                    Payment.objects.filter(user=client).select_related("user__client_profile")[:50],
                    many=True,
                ).data,
            }
        )


class ClientWalletView(APIView):
    """Crédito ou débito manual na carteira do cliente."""

    permission_classes = [IsSiteAdmin]

    def post(self, request, pk):
        client = get_object_or_404(User, pk=pk, role=User.Role.CLIENT)
        serializer = WalletOperationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        is_credit = data["operation"] == "credit"
        description = data.get("description") or (
            "Crédito lançado pelo admin" if is_credit else "Ajuste lançado pelo admin"
        )
        wallet, _ = Wallet.objects.get_or_create(user=client)
        try:
            entry = WalletService.apply(
                wallet=wallet,
                amount=data["amount"] if is_credit else -data["amount"],
                entry_type=(
                    LedgerEntry.EntryType.CREDIT_MANUAL if is_credit else LedgerEntry.EntryType.ADJUSTMENT
                ),
                description=description,
                created_by=request.user,
            )
        except InsufficientBalance:
            return Response(
                {"detail": f"Saldo insuficiente. Saldo atual: R$ {wallet.balance}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if is_credit:
            notify_user(
                client.id,
                {
                    "type": "wallet_credited",
                    "amount": str(data["amount"]),
                    "balance": str(entry.balance_after),
                    "description": description,
                },
            )
        return Response(
            {"balance": str(entry.balance_after), "entry": LedgerEntrySerializer(entry).data},
            status=status.HTTP_201_CREATED,
        )


def managed_user(pk):
    """Clientes e motoristas; contas de admin não são alteradas pelo painel."""
    return get_object_or_404(User, pk=pk, role__in=[User.Role.CLIENT, User.Role.DRIVER], is_staff=False)


class UserSetPasswordView(APIView):
    permission_classes = [IsSiteAdmin]

    def post(self, request, pk):
        user = managed_user(pk)
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password = serializer.validated_data.get("password") or generate_password()
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response(
            {"password": password, "detail": f"Nova senha definida para {user.username}."}
        )


class UserSendResetEmailView(APIView):
    permission_classes = [IsSiteAdmin]

    def post(self, request, pk):
        user = managed_user(pk)
        if not user.email:
            return Response(
                {"detail": "Esta conta não tem e-mail cadastrado. Defina uma nova senha manualmente."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            send_password_reset_email(user)
        except Exception:
            return Response(
                {"detail": "Não foi possível enviar o e-mail. Verifique a configuração de e-mail do servidor."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"detail": f"Link de redefinição enviado para {user.email}."})


class DriverListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSiteAdmin]
    pagination_class = AdminPagination

    def get_serializer_class(self):
        return DriverCreateSerializer if self.request.method == "POST" else AdminDriverSerializer

    def get_queryset(self):
        return search_filter(
            drivers_queryset(), self.request.query_params.get("search"), ["driver_profile__vehicle_info"]
        )

    def create(self, request, *args, **kwargs):
        serializer = DriverCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        driver = serializer.save()
        return Response(
            AdminDriverSerializer(drivers_queryset().get(pk=driver.pk)).data,
            status=status.HTTP_201_CREATED,
        )


class DriverDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSiteAdmin]
    serializer_class = AdminDriverSerializer
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        return drivers_queryset()


class PaymentListView(generics.ListAPIView):
    permission_classes = [IsSiteAdmin]
    serializer_class = AdminPaymentSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = Payment.objects.select_related("user", "user__client_profile")
        status_filter = self.request.query_params.get("status")
        return qs.filter(status=status_filter) if status_filter else qs


def pix_settings_payload(check: dict | None = None) -> dict:
    obj = PaymentSettings.load()
    token = mercadopago_token()
    return {
        "mode": pix_mode(),
        "source": "panel" if obj.mercadopago_access_token else ("env" if token else None),
        "token_preview": f"{token[:8]}…{token[-4:]}" if token else "",
        "is_test_token": token.startswith("TEST-"),
        "webhook_url": f"{settings.BACKEND_URL.rstrip('/')}/api/payments/webhook/mercadopago/",
        "updated_at": obj.updated_at,
        "updated_by": obj.updated_by.display_name if obj.updated_by else None,
        "check": check,
    }


class PixSettingsView(APIView):
    permission_classes = [IsSiteAdmin]

    def get(self, request):
        return Response(pix_settings_payload())

    def put(self, request):
        serializer = PixSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["access_token"]
        check = None
        if token:
            check = check_token(token)
            if check["refused"]:
                return Response({"detail": check["message"]}, status=status.HTTP_400_BAD_REQUEST)
        obj = PaymentSettings.load()
        obj.mercadopago_access_token = token
        obj.updated_by = request.user
        obj.save()
        return Response(pix_settings_payload(check))


class PixTestView(APIView):
    permission_classes = [IsSiteAdmin]

    def post(self, request):
        token = mercadopago_token()
        if not token:
            return Response(
                {"detail": "Nenhum token configurado."}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(pix_settings_payload(check_token(token)))
