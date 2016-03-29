from django.conf.urls import url
from django.contrib.auth.views import login as django_login_view

from .views import HomePageView, LogoutView, UserRegistrationView

urlpatterns = [
    url(r'^register/', UserRegistrationView.as_view(), name='register'),
    url(r'^logout/', LogoutView.as_view(), name='logout'),
    url(r'^login/', django_login_view, name='login'),
    url(r'^$', HomePageView.as_view(), name='home'),
]
