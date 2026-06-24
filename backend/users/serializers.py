from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "initials", "persona_id"]

    def get_name(self, obj):
        return obj.get_full_name() or obj.username


class GACMTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
