<div class="row">
	<div class="col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
		{{ Form::open($form2_data) }}
			<fieldset>
			<legend>Monthly Reset</legend>
			<div class="alert alert-info" role="alert">This is the reset that you use when you have entered a new month. It sets all the category balances to zero.</div>
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