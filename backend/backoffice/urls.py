from django.urls import path

from . import views

urlpatterns = [
    path("summary/", views.SummaryView.as_view(), name="admin-summary"),
    path("clients/", views.ClientListView.as_view(), name="admin-clients"),
    path("clients/<int:pk>/", views.ClientDetailView.as_view(), name="admin-client-detail"),
    path("clients/<int:pk>/wallet/", views.ClientWalletView.as_view(), name="admin-client-wallet"),
    path("drivers/", views.DriverListCreateView.as_view(), name="admin-drivers"),
    path("drivers/<int:pk>/", views.DriverDetailView.as_view(), name="admin-driver-detail"),
    path("admins/", views.AdminUserListCreateView.as_view(), name="admin-admins"),
    path("admins/<int:pk>/", views.AdminUserDetailView.as_view(), name="admin-admin-detail"),
    path("users/<int:pk>/password/", views.UserSetPasswordView.as_view(), name="admin-user-password"),
    path(
        "users/<int:pk>/password-email/",
        views.UserSendResetEmailView.as_view(),
        name="admin-user-password-email",
    ),
    path("payments/", views.PaymentListView.as_view(), name="admin-payments"),
    path("pix/", views.PixSettingsView.as_view(), name="admin-pix"),
    path("pix/test/", views.PixTestView.as_view(), name="admin-pix-test"),
]
