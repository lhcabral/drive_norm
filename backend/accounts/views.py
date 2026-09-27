import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Q
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import ClientProfile
from .passwords import send_password_reset_email
from .serializers import (
    ClientLookupSerializer,
    PasswordForgotSerializer,
    PasswordResetConfirmSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ClientLookupView(APIView):
    """Motorista busca cliente pelo código."""

    def get(self, request):
        if request.user.role != User.Role.DRIVER and not request.user.is_staff:
            return Response(
                {"detail": "Apenas motoristas podem buscar clientes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        code = (request.query_params.get("code") or "").strip().upper()
        if not code:
            return Response(
                {"detail": "Informe o código do cliente."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            profile = ClientProfile.objects.select_related("user", "user__wallet").get(
                code=code
            )
        except ClientProfile.DoesNotExist:
            return Response(
                {"detail": "Cliente não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        data = {
            "code": profile.code,
            "full_name": profile.user.display_name,
            "balance": str(profile.user.wallet.balance),
            "user_id": profile.user_id,
        }
        return Response(ClientLookupSerializer(data).data)


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]


class PasswordForgotView(APIView):
    """Envia o link de redefinição para o e-mail da conta (usuário ou e-mail informado).

    A resposta é sempre a mesma, para não revelar quais contas existem.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordForgotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"].strip()
        users = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier), is_active=True
        ).exclude(email="")
        for user in users:
            try:
                send_password_reset_email(user)
            except Exception:
                logger.exception("Falha ao enviar e-mail de redefinição para o usuário %s", user.pk)
        return Response(
            {
                "detail": (
                    "Se existir uma conta com e-mail cadastrado para esses dados, enviamos um "
                    "link para criar uma nova senha. Sem e-mail cadastrado? Fale com o suporte "
                    "pelo WhatsApp."
                )
            }
        )


class PasswordResetConfirmView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(data["uid"])), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None
        if user is None or not default_token_generator.check_token(user, data["token"]):
            return Response(
                {"detail": "Link inválido ou expirado. Peça um novo link."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(data["password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Senha alterada. Você já pode entrar com a nova senha."})
