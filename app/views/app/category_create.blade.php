<div class="row budget-add-buttons">
	<div class="col-sm-3 col-sm-offset-3 col-md-2 col-md-offset-4">
		<button type="button" class="btn btn-block btn-default cat-btn" disabled="disabled">Add Category</button>
	</div>
	<div class="col-sm-3 col-md-2">
		<button type="button" class="btn btn-block btn-primary cc-btn">Add Credit Card</button>
	</div>
</div>
<br />
<div class="row">
	<div class="col-sm-6 col-sm-offset-3 col-md-4 col-md-offset-4">
		{{ Form::open(array('url' => 'budget','class'=>'form well','autocomplete'=>'off')) }}
			<fieldset>
			<legend>Add a Category</legend>
			@foreach($errors->all() as $message)
			        <div class="alert alert-warning">{{ $message }}</div>
			@endforeach

				<div class="form-group">
					{{ Form::label('category_name', 'Category Name'); }}
					{{ Form::text('category_name',null,array('class'=>'form-control','placeholder'=>'Enter Category Name')) }}
				</div>
				<div class="form-group">
					{{ Form::label('top_limit', 'Spending Limit'); }}
					<div class="input-group">
  						<span class="input-group-addon">$</span> 
						{{ Form::input('number','top_limit',null,array('class'=>'form-control')) }}
					</div>
				</div>
				<div class="if-cc" style="display:none;">
				<div class="form-group">
					{{ Form::label('due_date', 'Payment Due Date (optional)'); }}
					<div class="input-group">
  						<span class="input-group-addon">On the</span>
						{{ Form::select('due_date',$dom_dd,null,array('class'=>'form-control')) }}
  						<span class="input-group-addon">of the Month</span> 
					</div>
				</div>
				</div>
				

			   

			    {{-- Form submit button. --------------------}}
			    {{ Form::submit('Create Category',['class'=>'btn btn-primary']) }}
			    <a href="/budget" class="btn btn-default">Cancel</a>

			</fieldset>

			{{ Form::close() }}
	</div>
</div>