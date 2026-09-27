from django.urls import path

from .views import LedgerListView, ManualCreditView, WalletView

urlpatterns = [
    path("", WalletView.as_view(), name="wallet"),
    path("ledger/", LedgerListView.as_view(), name="wallet-ledger"),
    path("credit/", ManualCreditView.as_view(), name="wallet-credit"),
]
