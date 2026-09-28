import re

from django.db import migrations

LOCAL_URL = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?/?$")


def clear_local_app_url(apps, schema_editor):
    """O antigo padrão http://localhost:5173 era salvo junto com a seção "general".

    Vazio passa a significar "usar o FRONTEND_URL do servidor".
    """
    LandingContent = apps.get_model("landing_content", "LandingContent")
    for obj in LandingContent.objects.all():
        general = obj.overrides.get("general")
        if isinstance(general, dict) and LOCAL_URL.match(str(general.get("app_url", ""))):
            general["app_url"] = ""
            obj.save(update_fields=["overrides"])


class Migration(migrations.Migration):
    dependencies = [("landing_content", "0001_initial")]

    operations = [migrations.RunPython(clear_local_app_url, migrations.RunPython.noop)]
