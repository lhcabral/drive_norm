import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from PIL import Image, UnidentifiedImageError
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSiteAdmin

from .content import automatic_values, merged_content, public_content, validate_section
from .defaults import DEFAULT_CONTENT, SECTION_KEYS
from .models import LandingContent

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp", "GIF": "gif"}


def admin_payload(obj: LandingContent) -> dict:
    return {
        "content": merged_content(obj.overrides),
        "defaults": DEFAULT_CONTENT,
        "customized": obj.customized_sections,
        "automatic": automatic_values(),
        "updated_at": obj.updated_at,
        "updated_by": obj.updated_by.display_name if obj.updated_by else None,
    }


class PublicLandingContentView(APIView):
    """Conteúdo lido pela landing page, que pode estar hospedada em outro domínio."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        obj = LandingContent.load()
        response = Response(public_content(obj.overrides))
        response["Access-Control-Allow-Origin"] = "*"
        response["Cache-Control"] = "no-cache"
        return response


class AdminLandingContentView(APIView):
    permission_classes = [IsSiteAdmin]

    def get(self, request):
        return Response(admin_payload(LandingContent.load()))


class AdminLandingSectionView(APIView):
    permission_classes = [IsSiteAdmin]

    def put(self, request, section):
        if section not in SECTION_KEYS:
            return Response({"detail": "Seção inexistente."}, status=status.HTTP_404_NOT_FOUND)
        obj = LandingContent.load()
        obj.overrides[section] = validate_section(section, request.data)
        obj.updated_by = request.user
        obj.save()
        return Response(admin_payload(obj))

    def delete(self, request, section):
        """Restaura a seção para o conteúdo padrão."""
        if section not in SECTION_KEYS:
            return Response({"detail": "Seção inexistente."}, status=status.HTTP_404_NOT_FOUND)
        obj = LandingContent.load()
        obj.overrides.pop(section, None)
        obj.updated_by = request.user
        obj.save()
        return Response(admin_payload(obj))


class AdminLandingResetView(APIView):
    """Restaura todas as seções para o conteúdo padrão."""

    permission_classes = [IsSiteAdmin]

    def post(self, request):
        obj = LandingContent.load()
        obj.overrides = {}
        obj.updated_by = request.user
        obj.save()
        return Response(admin_payload(obj))


class AdminLandingUploadView(APIView):
    permission_classes = [IsSiteAdmin]
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "Envie um arquivo no campo 'file'."}, status=400)
        if upload.size > MAX_UPLOAD_BYTES:
            return Response({"detail": "A imagem deve ter no máximo 5 MB."}, status=400)
        try:
            with Image.open(upload) as img:
                image_format = img.format
                img.verify()
        except (UnidentifiedImageError, OSError, SyntaxError):
            return Response({"detail": "Arquivo de imagem inválido."}, status=400)
        extension = ALLOWED_IMAGE_FORMATS.get(image_format)
        if not extension:
            return Response({"detail": "Use imagens JPG, PNG, WEBP ou GIF."}, status=400)

        upload.seek(0)
        name = default_storage.save(f"landing/{uuid.uuid4().hex}.{extension}", upload)
        url = settings.BACKEND_URL.rstrip("/") + default_storage.url(name)
        return Response({"url": url}, status=status.HTTP_201_CREATED)
