<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nickelpinch</title>

    <!-- Bootstrap -->
    <link async href="/css/bootstrap.min.css" rel="stylesheet">
    <link async href="/css/bootstrap.tweaks.css" rel="stylesheet">

    <!-- HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
      <script src="https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
      <script src="https://oss.maxcdn.com/libs/respond.js/1.4.2/respond.min.js"></script>
    <![endif]-->
  </head>
  <body>
    @if(Auth::check())
    @include('home.nav')
    @else
    <div class="container" style="text-align:center;">
      <h1 style="margin:30px auto;">Nickelpinch</h1>
    </div>
    @endif

    @yield('content')

    <!-- jQuery (necessary for Bootstrap's JavaScript plugins) -->
    <script async src="/js/jquery.1.11.0.min.js"></script>
    <!-- Include all compiled plugins (below), or include individual files as needed -->
    <script async src="/js/bootstrap.min.js"></script>
    @if(Auth::check())
    <script async src="/js/app.js?v=11"></script>
    @endif
  </body>
</html>
