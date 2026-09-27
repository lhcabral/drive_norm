from django.urls import path

from .views import (
    CreatePixView,
    MercadoPagoWebhookView,
    PaymentDetailView,
    SimulatePixApproveView,
)

urlpatterns = [
    path("pix/", CreatePixView.as_view(), name="payments-pix"),
    path("<int:pk>/", PaymentDetailView.as_view(), name="payments-detail"),
    path(
        "<int:pk>/simulate-approve/",
        SimulatePixApproveView.as_view(),
        name="payments-simulate-approve",
    ),
    path(
        "webhook/mercadopago/",
        MercadoPagoWebhookView.as_view(),
        name="payments-mp-webhook",
    ),
]
