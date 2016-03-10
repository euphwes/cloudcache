from authentication.models import Account
from rest_framework.serializers import HyperlinkedModelSerializer

# ----------------------------------------------------------------------------------------------------------------------

class AccountSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Account model list and detail endpoints. """

    class Meta:
        model = Account
        fields = ('id', 'username', 'email', 'url')

        extra_kwargs = {
            'id': {'read_only': True},    # Shouldn't be able to edit ID
        }
