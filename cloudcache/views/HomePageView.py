from django.views.generic import TemplateView

from . import LoginRequiredMixin

# ----------------------------------------------------------------------------------------------------------------------

class HomePageView(LoginRequiredMixin, TemplateView):
    """ Placeholder homepage view. """

    template_name = 'cloudcache/home/home.html'


    def get_context_data(self, **kwargs):
        """ Builds the context with the currently logged-in User. """
        context = super().get_context_data(**kwargs)
        context['user'] = self.request.user
        return context
