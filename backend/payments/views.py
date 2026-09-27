import logging
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment, PaymentService, PixNotConfigured
from .serializers import CreatePixSerializer, PaymentSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


class CreatePixView(APIView):
    def post(self, request):
        if request.user.role != User.Role.CLIENT:
            return Response(
                {"detail": "Apenas clientes podem gerar PIX."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CreatePixSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = PaymentService.create_pix(
                request.user, Decimal(serializer.validated_data["amount"])
            )
        except PixNotConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class PaymentDetailView(APIView):
    def get(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk, user=request.user)
        except Payment.DoesNotExist:
            return Response({"detail": "Pagamento não encontrado."}, status=404)
        if payment.status == Payment.Status.PENDING:
            # Não depende só do webhook, que não alcança o backend em ambiente local.
            try:
                payment = PaymentService.sync_status(payment)
            except Exception:
                logger.exception("Falha ao consultar o pagamento %s no Mercado Pago", payment.pk)
        return Response(PaymentSerializer(payment).data)


class SimulatePixApproveView(APIView):
    """Aprova PIX simulado, apenas em desenvolvimento (DEBUG e sem token Mercado Pago)."""

    def post(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk, user=request.user)
        except Payment.DoesNotExist:
            return Response({"detail": "Pagamento não encontrado."}, status=404)
        if not settings.DEBUG or not str(payment.external_id or "").startswith("sim-"):
            return Response(
                {"detail": "Somente pagamentos simulados podem ser aprovados aqui."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payment = PaymentService.mark_approved(payment)
        return Response(PaymentSerializer(payment).data)


class MercadoPagoWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data or {}
        topic = data.get("type") or data.get("topic") or request.query_params.get("type")
        payment_id = None
        if isinstance(data.get("data"), dict):
            payment_id = data["data"].get("id")
        payment_id = payment_id or request.query_params.get("data.id") or data.get("id")

        if topic and "payment" not in str(topic):
            return Response({"ok": True})

        if not payment_id:
            return Response({"ok": True})

        external_id = str(payment_id)
        try:
            payment = Payment.objects.get(external_id=external_id)
        except Payment.DoesNotExist:
            # Pode chegar pelo external_reference
            ref = data.get("external_reference")
            if ref:
                payment = Payment.objects.filter(pk=ref).first()
            else:
                return Response({"ok": True})

        if not payment:
            return Response({"ok": True})

        if settings.DEBUG and external_id.startswith("sim-") and data.get("force_approve"):
            PaymentService.mark_approved(payment)
        else:
            PaymentService.sync_status(payment)

        return Response({"ok": True})
