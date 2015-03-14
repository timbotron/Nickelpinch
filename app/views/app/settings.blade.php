@extends('home.base')

@section('content')
<div class="container">
	<div class="row entry-add">
		<div class="col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
			{{ Form::open($form1_data) }}
			<fieldset>
			<legend>Choose Default Entry Payment Method</legend>
			<div class="alert alert-info" role="alert">This is the default payment method pre-selected on the Add Entry form.</div>
			<div class="default_pmt-messages"></div>
			<div class="form-group">
				{{ Form::label('chosen_default_pmt', 'Payment Method') }}
				{{ Form::select('chosen_default_pmt',$paid_with,$user_data->default_pmt_method,array('class'=>'form-control')) }}
			</div>
			

			{{-- Form submit button. --------------------}}
			<div class="default_pmt-status"></div>
			<div class="btns-to-toggle">
				{{ Form::submit('Save New Default',['class'=>'btn btn-primary']) }}
				<a class="btn btn-default" href="/home">Cancel</a>
			</div>
			</fieldset>
			{{ Form::close() }}

			{{ Form::open($form2_data) }}
			<fieldset>
			<legend>Category Reset</legend>
			<div class="alert alert-info" role="alert">This is the reset that you use when you have entered a new month. It sets all the category balances to zero, and any extra room in your categories get moved to savings<br /><strong>This cannot be undone.</strong></div>
			<div class="monthly_reset-messages"></div>			

			{{-- Form submit button. --------------------}}
			<div class="default_pmt-status"></div>
			<div class="btns-to-toggle">
				{{ Form::submit('Reset Categories',['class'=>'btn btn-primary']) }}
				<a class="btn btn-default" href="/home">Cancel</a>
			</div>
			</fieldset>
			{{ Form::close() }}
			

			
		</div>
	</div>
	

</div>

@stop