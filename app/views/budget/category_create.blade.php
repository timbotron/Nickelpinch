@if(!$edit)
<div class="row budget-add-buttons">
	<div class="col-sm-6 col-sm-offset-3 col-md-4 col-md-offset-4">
		<h4>Add:</h4>
		<div class="btn-group">
			<button type="button" class="btn btn-primary btn-sm cat-btn" disabled="disabled">Category</button>
			<button type="button" class="btn btn-default btn-sm cc-btn">Credit Card</button>
			<button type="button" class="btn btn-default btn-sm sav-btn">Savings</button>
			<button type="button" class="btn btn-default btn-sm exsav-btn">External Savings</button>
		</div>
	</div>
</div>
<br />
@endif
<div class="row">
	<div class="col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
		{{ Form::open($form_data) }}
			<fieldset>
			@if($edit)
			<legend>Edit {{ $nikl_config['uc_class_def'][$uc->class]}} Category</legend>
			@else
			<legend>Add a Category</legend>
			@endif
			@foreach($errors->all() as $message)
			        <div class="alert alert-warning">{{ $message }}</div>
			@endforeach

				<div class="form-group">
					{{ Form::label('category_name', 'Category Name'); }}
					{{ Form::text('category_name',($edit ? $uc->category_name : null),array('class'=>'form-control','placeholder'=>'Enter Category Name')) }}
				</div>
				<div class="form-group">
					{{ Form::label('top_limit', 'Monthly Spending Limit'); }}
					<div class="input-group">
  						<span class="input-group-addon">{{ $nikl_config['currency_options'][$user_data->currency] }}</span> 
						{{ Form::input('number','top_limit',($edit ? $uc->top_limit: null),array('class'=>'form-control')) }}
					</div>
				</div>
				@if($edit)
				
				<div class="form-group">
					{{ Form::label('rank', 'Position'); }}
					{{ Form::input('number','rank',($edit ? $uc->rank: null),array('class'=>'form-control')) }}
				</div>
				@else
				{{ Form::hidden('rank',1000) }}
				{{ Form::hidden('class',$the_class) }}

				@endif
				{{ Form::hidden('class',$the_class) }}
				<div class="if-cc" style="display:none;">
				<div class="form-group">
					{{ Form::label('due_date', 'Payment Due Date (optional)'); }}
					<div class="input-group">
  						<span class="input-group-addon">On the</span>
						{{ Form::select('due_date',$dom_dd,($edit ? $uc->due_date : null),array('class'=>'form-control')) }}
  						<span class="input-group-addon">of the Month</span> 
					</div>
				</div>
				</div>
				

			   

			    {{-- Form submit button. --------------------}}
			    @if($edit)
			    {{ Form::submit('Edit Category',['class'=>'btn btn-primary']) }}
			    @else
			    {{ Form::submit('Create Category',['class'=>'btn btn-primary']) }}
			    @endif
			    <a href="/budget" class="btn btn-default">Cancel</a>

			</fieldset>

			{{ Form::close() }}
	</div>
</div>