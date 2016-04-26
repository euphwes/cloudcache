from cloudcache.models import Checklist
from rest_framework.serializers import HyperlinkedModelSerializer

# ----------------------------------------------------------------------------------------------------------------------

class ChecklistSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Checklist model list and detail endpoints. """

    class Meta:
        model = Checklist
        fields = ('id', 'title', 'notebook', 'items', 'created', 'modified', 'url')

        extra_kwargs = {
            'id': {'read_only': True},     # Shouldn't be able to edit ID
            'items': {'read_only': True},  # Can't edit the contained items here, do that in ChecklistItem detail view
        }