from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("accounts.urls_me")),
    path("api/wallet/", include("wallet.urls")),
    path("api/rides/", include("rides.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/landing/", include("landing_content.urls")),
    path("api/admin/", include("backoffice.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
