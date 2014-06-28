<div class="navbar navbar-default">
      <div class="container">
        <div class="navbar-header">
          <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
            <span class="sr-only">Toggle navigation</span><span class="icon-bar"></span><span class="icon-bar"></span><span class="icon-bar"></span>
          </button>
          <a href="/" class="navbar-brand">Nickelpinch</a>
        </div>
        <div class="collapse navbar-collapse">
          <ul class="nav navbar-nav navbar-right">
            <li>
              <a href="/home"><span class="glyphicon glyphicon-home"></span> Overview</a>
            </li>
            <li>
              <a href="#"><span class="glyphicon glyphicon-random"></span> Move</a>
            </li>
            <li>
              <a href="#"><span class="glyphicon glyphicon-sort"></span> Deposit/Withdraw</a>
            </li>
            <li>
              <a href="#"><span class="glyphicon glyphicon-send"></span> Bill/Check</a>
            </li>
            <li {{ $chosen_page=='budget' ? 'class="active"' : '' }}>
              <a href="/budget"><span class="glyphicon glyphicon-list"></span> Budget</a>
            </li>
            <li>
              <a href="#"><span class="glyphicon glyphicon-signal"></span> Reports</a>
            </li>
            <li class="dropdown">
              <a href="#" class="dropdown-toggle" data-toggle="dropdown"><span class="glyphicon glyphicon-user"></span> Account <b class="caret"></b></a>
              <ul class="dropdown-menu">
                <li>
                  <a href="#"><span class="glyphicon glyphicon-user"></span> My Account</a>
                </li>
                <li>
                  <a href="#"><span class="glyphicon glyphicon-cog"></span> Settings</a>
                </li>
                <li>
                  <a href="#"><span class="glyphicon glyphicon-off"></span> Log Off</a>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>