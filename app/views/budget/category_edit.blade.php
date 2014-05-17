
<div class="row">
	<div class="col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
		{{ Form::open($form_data) }}
			<fieldset>
			<legend>Edit {{ $nikl_config['uc_class_def'][$uc->class]}} Category</legend>
			@foreach($errors->all() as $message)
			        <div class="alert alert-warning">{{ $message }}</div>
			@endforeach

				<div class="form-group">
					{{ Form::label('category_name', 'Category Name'); }}
					{{ Form::text('category_name',$uc->category_name,array('class'=>'form-control','placeholder'=>'Enter Category Name')) }}
				</div>
				<div class="form-group">
					{{ Form::label('top_limit', 'Monthly Spending Limit'); }}
					<div class="input-group">
  						<span class="input-group-addon">{{ $currency }}</span> 
						{{ Form::input('number','top_limit',$uc->top_limit,array('class'=>'form-control')) }}
					</div>
				</div>
				<div class="form-group">
					{{ Form::label('rank', 'Position'); }}
					{{ Form::input('number','rank',$uc->rank,array('class'=>'form-control')) }}
				</div>
				{{ Form::hidden('class',$the_class) }}
				@if($the_class=='credit_card')
				<div class="if-cc">
				<div class="form-group">
					{{ Form::label('due_date', 'Payment Due Date (optional)'); }}
					<div class="input-group">
  						<span class="input-group-addon">On the</span>
						{{ Form::select('due_date',$dom_dd,$uc->due_date,array('class'=>'form-control')) }}
  						<span class="input-group-addon">of the Month</span> 
					</div>
				</div>
				</div>
				@endif
				

			   

			    {{-- Form submit button. --------------------}}
			    {{ Form::submit('Edit Category',['class'=>'btn btn-primary']) }}
			    <a href="/budget" class="btn btn-default">Cancel</a>

			</fieldset>

			{{ Form::close() }}
	</div>
</div>