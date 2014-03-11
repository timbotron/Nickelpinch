@extends('home.base')

@section('content')
<div class="container">
	<div class="row">
		<div class="col-sm-6 col-sm-offset-3 col-md-4 col-md-offset-4">
			{{ Form::open(array('url' => 'register','class'=>'form')) }}
			<fieldset>
			<legend>Create an Account</legend>

				<div class="form-group">
					{{ Form::label('email', 'E-Mail Address'); }}
					{{ Form::email('email',null,['class'=>'form-control','placeholder'=>'Enter email']) }}
				</div>
				<div class="form-group">
					{{ Form::label('username', 'Username'); }}
					{{ Form::text('username',null,['class'=>'form-control','placeholder'=>'Username']) }}
				</div>
				<div class="form-group">
					{{ Form::label('password', 'Password'); }}
					{{ Form::password('password',['class'=>'form-control','placeholder'=>'Password']) }}
				</div>

			   

			    {{-- Form submit button. --------------------}}
			    {{ Form::submit('Sign Up',['class'=>'btn btn-primary']) }}
			    <a href="/" class="btn btn-default">Cancel</a>

			</fieldset>

			{{ Form::close() }}
		</div>
	</div>

</div>

@stop