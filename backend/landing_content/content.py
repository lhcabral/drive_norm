import copy
import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework.exceptions import ValidationError

from .defaults import DEFAULT_CONTENT, ICONS

MAX_TEXT_LENGTH = 2000
MAX_LIST_ITEMS = 30
IMAGE_FIELDS = {"image", "flyer_image"}

_url_validator = URLValidator(schemes=["http", "https"])
_relative_path = re.compile(r"^(?!//)[\w\-./]+$")


def _validate_field(name: str, value: str, path: str) -> None:
    if name == "icon" and value not in ICONS:
        raise ValidationError({path: f"Ícone inválido. Opções: {', '.join(ICONS)}."})
    if name == "path" and not value.startswith("/"):
        raise ValidationError({path: "O caminho deve começar com /."})
    if name == "whatsapp_number" and not re.fullmatch(r"\d{10,15}", value):
        raise ValidationError({path: "Use apenas dígitos, com DDI e DDD (ex.: 5584999999999)."})
    if name == "app_url" or (name in IMAGE_FIELDS and "://" in value):
        try:
            _url_validator(value)
        except DjangoValidationError:
            raise ValidationError({path: "Informe uma URL http(s) válida."})
    elif name in IMAGE_FIELDS and not _relative_path.match(value):
        raise ValidationError({path: "Informe uma URL http(s) ou um caminho como assets/foto.jpg."})


def _clean(value, default, path: str, name: str, strict: bool):
    """Ajusta `value` ao formato de `default`.

    No modo estrito, formatos inválidos geram erro; caso contrário, voltam ao padrão
    (usado ao ler dados salvos antes de uma mudança na estrutura).
    """

    def fail(message):
        if strict:
            raise ValidationError({path: message})
        return copy.deepcopy(default)

    if isinstance(default, bool):
        return value if isinstance(value, bool) else fail("Deve ser verdadeiro ou falso.")

    if isinstance(default, (int, float)):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return fail("Deve ser um número.")
        if value < 0 or value > 1_000_000:
            return fail("Número fora do intervalo permitido.")
        return value

    if isinstance(default, str):
        if not isinstance(value, str):
            return fail("Deve ser um texto.")
        value = value.strip()
        if len(value) > MAX_TEXT_LENGTH:
            return fail(f"Máximo de {MAX_TEXT_LENGTH} caracteres.")
        try:
            _validate_field(name, value, path)
        except ValidationError:
            if strict:
                raise
            return default
        return value

    if isinstance(default, list):
        if not isinstance(value, list):
            return fail("Deve ser uma lista.")
        if len(value) > MAX_LIST_ITEMS:
            return fail(f"Máximo de {MAX_LIST_ITEMS} itens.")
        template = default[0]
        return [
            _clean(item, template, f"{path}[{i}]", name, strict) for i, item in enumerate(value)
        ]

    if isinstance(default, dict):
        if not isinstance(value, dict):
            return fail("Formato inválido.")
        unknown = set(value) - set(default)
        if unknown and strict:
            raise ValidationError({path: f"Campos desconhecidos: {', '.join(sorted(unknown))}."})
        return {
            key: _clean(value[key], sub_default, f"{path}.{key}", key, strict)
            if key in value
            else copy.deepcopy(sub_default)
            for key, sub_default in default.items()
        }

    return copy.deepcopy(default)


def validate_section(section: str, value) -> dict:
    return _clean(value, DEFAULT_CONTENT[section], section, section, strict=True)


def merged_content(overrides: dict) -> dict:
    """Conteúdo final: padrão de cada seção, substituído pelo que o admin salvou."""
    return {
        section: _clean(overrides[section], default, section, section, strict=False)
        if section in overrides
        else copy.deepcopy(default)
        for section, default in DEFAULT_CONTENT.items()
    }
