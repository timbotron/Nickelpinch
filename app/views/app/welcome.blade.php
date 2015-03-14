@extends('home.base')

@section('content')
<div class="container">
	<div class="row">
		<div class="col-sm-9 col-sm-offset-2">
			<h2>Welcome {{ $user_data->username }}!</h2>
			<p>Thank you for creating your account. Please follow the steps below to configure your account.</p>
			{{--- Does user have bank account set? ---}}
			@if(!$bank_info)
			<div class="alert alert-info">
				<strong>Bank Account</strong>
				<p>Please set your bank account using the link below. Remember, we are just setting the name and current balance of your account. We never connect to your bank.</p>

			</div>
			<a href="/add_bank" class="btn btn-primary btn-lg">Set up your Bank Account</a><br /><br /><br />
			@endif
			
			<div class="alert alert-info">
				<strong>Categories</strong>
				<p>Please set your categories using the link below. Categories are how you can separate your money in your bank account into different areas. You will be able to set spending limits, see how on track you are, etc. Also, if you have a credit card(s) and use them for purchases, you can also enter them there.</p>

			</div>
			<a href="/budget" class="btn btn-primary btn-lg">Set up your Categories</a>
			

		</div>
	</div>


</div>

@stop