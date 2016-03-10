from authentication.models import Account
from rest_framework.serializers import HyperlinkedModelSerializer

# ----------------------------------------------------------------------------------------------------------------------

class AccountSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Account model list and detail endpoints. """

    class Meta:
        model = Account
        fields = ('id', 'username', 'email', 'created_at', 'updated_at', 'password', 'url')

        extra_kwargs = {
            'id': {'read_only': True},         # Can't edit ID
            'password': {'write_only': True},  # Can't read password
        }


    def create(self, validated_data):
        """ Need to properly set password for the new account during creation in a POST request. """

        account = Account(**validated_data)

        password = validated_data.get('password', None)
        if password:
            account.set_password(password)

        account.save()
        return account


    def update(self, instance, validated_data):
        """ Need to properly set password for the updated account during a PUT or PATCH request. If a username, email,
         or password isn't supplied in the update request, just keep the Account's previous value for that field. """

        username = validated_data.get('username', None)
        if username:
            instance.username = username

        email = validated_data.get('email', None)
        if email:
            instance.email = email

        password = validated_data.get('password', None)
        if password:
            instance.set_password(password)

        instance.save()
        return instance
