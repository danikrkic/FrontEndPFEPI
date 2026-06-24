from rest_framework.generics import RetrieveAPIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import GACMTokenObtainPairSerializer, UserSerializer


class GACMTokenObtainPairView(TokenObtainPairView):
    serializer_class = GACMTokenObtainPairSerializer


class MeView(RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
