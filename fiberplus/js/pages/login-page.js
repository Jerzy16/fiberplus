/**
 * Credential gate for providers with requiresAuth=true (fiberplus).
 * One DxD skips this entirely since it's free.
 */
var LoginPage = (function () {
  function render(providerId) {
    var provider = Providers.getById(providerId);
    if (!provider) {
      Router.navigate('#providers');
      return;
    }
    if (!provider.requiresAuth) {
      Router.navigate('#home/' + providerId);
      return;
    }

    if (typeof VideoEngine !== 'undefined') VideoEngine.destroy();
    Store.setBackRoute('#providers');
    Store.setNavHandler(handleKeyNav);
    SpatialNav.clear();

    document.getElementById('app').innerHTML =
      '<div class="login-page" id="login-page-body">' +
      '<button class="icon-btn corner-btn" onclick="Router.navigate(\'#providers\')" title="Volver">' +
      Icons.back(20) +
      '</button>' +
      '<div class="login-card">' +
      loginCardContent(provider) +
      '</div>' +
      '</div>';

    bindForm(provider);
    SpatialNav.focusFirst(root());
  }

  function root() {
    return document.getElementById('login-page-body');
  }

  function handleKeyNav(e) {
    SpatialNav.handleKey(e, root());
  }

  function loginCardContent(provider) {
    return (
      '<div class="login-avatar">' +
      ProviderCard.logoFor(provider) +
      '</div>' +
      '<p>Ingresa tus credenciales para acceder</p>' +
      '<form id="login-form">' +
      '<input type="text" id="login-user" class="input" placeholder="Ingresa tu usuario" autocomplete="username" />' +
      '<input type="password" id="login-pass" class="input" placeholder="Ingresa tu contraseña" autocomplete="current-password" />' +
      '<button type="submit" class="btn btn-primary">Iniciar Sesion</button>' +
      '</form>'
    );
  }

  function bindForm(provider) {
    var form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitLogin(provider);
    });
  }

  async function submitLogin(provider) {
    var username = document.getElementById('login-user').value.trim();
    var password = document.getElementById('login-pass').value.trim();
    if (!username || !password) return;

    var card = document.querySelector('.login-card');
    card.innerHTML = StateMessage.loading('Verificando credenciales...');
    SpatialNav.ensureFocus(root());

    try {
      var channels = await IptvService.fetchForProvider(provider, {
        username: username,
        password: password
      });
      if (!channels.length) {
        throw new Error('No se encontraron canales para estas credenciales');
      }
      AuthService.saveSession(provider.id, { username: username, password: password });
      AuthService.saveChannels(provider.id, channels);
      Store.setChannels(provider.id, channels);
      Router.navigate('#home/' + provider.id);
    } catch (err) {
      card.innerHTML =
        StateMessage.error('Error al iniciar sesión: ' + err.message) +
        '<div class="state-actions"><button class="btn btn-primary" onclick="LoginPage.render(\'' +
        provider.id +
        '\')">Reintentar</button></div>';
      SpatialNav.ensureFocus(root());
    }
  }

  return { render: render };
})();
