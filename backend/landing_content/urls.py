from django.urls import path

from .views import (
    AdminLandingContentView,
    AdminLandingResetView,
    AdminLandingSectionView,
    AdminLandingUploadView,
    PublicLandingContentView,
)

urlpatterns = [
    path("", PublicLandingContentView.as_view(), name="landing-content"),
    path("admin/", AdminLandingContentView.as_view(), name="landing-admin"),
    path("admin/reset/", AdminLandingResetView.as_view(), name="landing-admin-reset"),
    path("admin/upload/", AdminLandingUploadView.as_view(), name="landing-admin-upload"),
    path(
        "admin/sections/<str:section>/",
        AdminLandingSectionView.as_view(),
        name="landing-admin-section",
    ),
]
