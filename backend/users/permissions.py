from rest_framework.permissions import BasePermission

# Traslado directo de la matriz `can()` en lib/store.tsx del frontend.
PERMISSION_MATRIX = {
    "contrato.crear": ["dependencia"],
    "contrato.activar": ["dependencia"],
    "contrato.revisar-activacion": ["residente"],
    "bitacora.abrir": ["residente"],
    "bitacora.notear": ["residente", "superintendente", "supervision"],
    "detalle.registrar": ["residente"],
    "estimacion.crear": ["superintendente"],
    "estimacion.revisar": ["supervision", "residente"],
    "convenio.crear": ["superintendente", "residente"],
    "convenio.revisar": ["dependencia"],
    "pago.dispersar": ["finanzas"],
    "avance.registrar": ["supervision"],
    "incumplimiento.registrar": ["residente"],
    "incumplimiento.resolver": ["residente"],
    "minuta.registrar": ["residente", "superintendente", "supervision"],
    "garantia.registrar": ["superintendente"],
    "cierre.terminar": ["residente"],
    "cierre.cargar-acta": ["residente"],
    "finiquito.emitir": ["residente"],
    "finiquito.notificar": ["residente"],
    "finiquito.responder": ["residente", "superintendente"],
    "finiquito.cerrar": ["residente"],
    "avance_concepto.registrar": ["superintendente"],
    "avance_concepto.validar": ["supervision"],
}


PERMISOS_POR_TIPO_NOTA = {
    "concepto_terminado": ["residente"],
}


def can(role: str | None, action: str) -> bool:
    if not role:
        return False
    return role in PERMISSION_MATRIX.get(action, [])


class HasRolePermission(BasePermission):
    """Uso: agregar `required_action = "contrato.crear"` a la vista/viewset."""

    def has_permission(self, request, view):
        action = getattr(view, "required_action", None)
        if action is None:
            return True
        user = request.user
        return bool(user and user.is_authenticated and can(user.role, action))
