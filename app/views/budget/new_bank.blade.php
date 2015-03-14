
<div class="row">
	<div class="col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
		{{ Form::open($form_data) }}
			<fieldset>
			
			<legend>Set your Bank Account Info</legend>
			
			@foreach($errors->all() as $message)
			        <div class="alert alert-warning">{{ $message }}</div>
			@endforeach

				<div class="form-group">
					{{ Form::label('category_name', 'Bank Account Name'); }}
					{{ Form::text('category_name',null,array('class'=>'form-control','placeholder'=>'Enter Bank Account Name','step'=>'any','min'=>'0')) }}
				</div>
				<div class="form-group">
					{{ Form::label('balance', 'Current Balance'); }}
					<div class="input-group">
  						<span class="input-group-addon">{{ $currency }}</span> 
						{{ Form::input('number','balance',null,array('class'=>'form-control','step'=>'any','min'=>'0')) }}
					</div>
				</div>
				
				{{ Form::hidden('rank',1) }}
				{{ Form::hidden('class','bank_account') }}

			

			    {{-- Form submit button. --------------------}}
			    {{ Form::submit('Save Bank Account Info',['class'=>'btn btn-primary']) }}
			    <a href="/budget" class="btn btn-default">Cancel</a>

			</fieldset>

			{{ Form::close() }}
	</div>
</div>