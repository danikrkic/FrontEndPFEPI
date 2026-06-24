from rest_framework.routers import DefaultRouter

from .views import ContractViewSet, ContratistaViewSet, PersonaViewSet

router = DefaultRouter()
router.register("contratistas", ContratistaViewSet, basename="contratista")
router.register("personas", PersonaViewSet, basename="persona")
router.register("contratos", ContractViewSet, basename="contrato")

urlpatterns = router.urls
