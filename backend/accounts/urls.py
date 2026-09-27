from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, PasswordForgotView, PasswordResetConfirmView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("password/forgot/", PasswordForgotView.as_view(), name="auth-password-forgot"),
    path("password/reset/", PasswordResetConfirmView.as_view(), name="auth-password-reset"),
]
