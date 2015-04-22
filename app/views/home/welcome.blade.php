@extends('home.base')

@section('content')
<div class="container">
	<div class="row">
		<div class="hidden-xs col-md-5 col-md-offset-1">
			<h2>This is a Nickelpinch instance</h2>
			<p class="lead">Nickelpinch is a web-based budgeting tool.</p>
			<p class="lead">It is open-source, and free to use.</p>
			<p class="lead">For more information, please visit our site</p>
			<a href="http://nickelpinch.com" class="btn btn-success btn-lg">Visit Nickelpinch.com</a>
		</div>
		<div class="well col-xs-8 col-xs-offset-2 col-md-4 col-md-offset-1">
			{{ Form::open(array('url' => 'login','class'=>'form','autocomplete'=>'off')) }}
			<fieldset>
			<legend>Login Here</legend>
			@foreach($errors->all() as $message)
			        <div class="alert alert-warning">{{ $message }}</div>
			@endforeach

				<div class="form-group">
					{{ Form::label('username', 'Username'); }}
					{{ Form::text('username',null,array('class'=>'form-control','placeholder'=>'Username')) }}
				</div>
				<div class="form-group">
					{{ Form::label('password', 'Password'); }}
					{{ Form::password('password',array('class'=>'form-control','placeholder'=>'Password')) }}
				</div>
				<div class="checkbox">
					<label>
					{{ Form::checkbox('remember_me','set') }}
						Remember Me
  					</label>
				</div>

			    {{-- Form submit button. --------------------}}
			    {{ Form::submit('Login',['class'=>'btn btn-primary']) }}
			    <a href="/" class="btn btn-default">Cancel</a><br /><br />
			    <a href="/forgot_password" class="btn btn-default btn-xs">Forgot Password?</a>
			    @if(Config::get('nickelpinch.gate_open'))
			    <a href="/register" class="btn btn-info btn-xs">Create Account</a>
			    @endif

			</fieldset>

			{{ Form::close() }}
		</div>

	</div>

</div>
@stop