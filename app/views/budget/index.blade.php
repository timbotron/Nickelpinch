@extends('home.base')

@section('content')
<div class="container">
	<div class="row budget-view">
		<div class="col-sm-10 col-sm-offset-1 col-md-8 col-md-offset-2">
		<h2>Budget</h2>
			@if(count($user_data->user_categories))
			<h5>Filter Categories:</h5>
			<label class="checkbox-inline filter-budget">
  				<input type="checkbox"  checked="checked" value="c20"> <span class="label label-primary">Standard</span>
			</label>
			<label class="checkbox-inline filter-budget">
  				<input type="checkbox"  value="c10"> <span class="label label-primary">Credit Card</span>
			</label>
			<label class="checkbox-inline filter-budget">
  				<input type="checkbox"  value="c255"> <span class="label label-default">Archived</span>
			</label>

			<br /><br />
			<table class="table">
				<tr>
					<th>Name</th>
					<th>Monthly Limit</th>
					<th>Type</th>
					<th></th>
				</tr>
				<?php $sum = 0.00;?>
				@foreach($user_data->user_categories as $cat)
				@if($cat->class != 8)
					<?php
						if($cat->class==20) $sum += $cat->top_limit;
					?>
					@if($cat->class == 20)
					<tr data-toplimit="{{ $cat->top_limit }}" class="c{{ $cat->class }}">
					@elseif($cat->class == 10)
					<tr data-toplimit="{{ $cat->top_limit }}" class="c{{ $cat->class }} info" style="display:none;">
					@else
					<tr data-toplimit="{{ $cat->top_limit }}" class="c{{ $cat->class }} active" style="display:none;">
					@endif
						<td>{{ $cat->category_name }}</td>
						<td>{{ $currency.$cat->top_limit }}</td>
						<td>
							@if($nikl_config['uc_class_def'][$cat->class] == 'Standard')
							<span class="label label-primary">
							@elseif($nikl_config['uc_class_def'][$cat->class] == 'Credit Card')
							<span class="label label-primary">
							@else
							<span class="label label-default">
							@endif
							{{ $nikl_config['uc_class_def'][$cat->class] }}
							</span>
						</td>
						<td class="tool-row">
							<a href="/budget/{{ $cat->ucid }}/edit" class="btn btn-warning btn-sm">
								<span class="glyphicon glyphicon-pencil"></span>
							</a>
							<a href="/history/{{ $cat->ucid }}" class="btn btn-default btn-sm">
								<span class="glyphicon glyphicon-stats"></span>
							</a>

						</td>

					</tr>
				@endif
				@endforeach
				<tr class="tr-sum">
					<td><strong>TOTAL</strong> <span data-toggle="tooltip" data-placement="top" title="Just the total from categories" class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></td>
					<td>{{ $currency }}<span class="budget-sum">{{ number_format($sum,2,'.','') }}</span></td>
					<td></td>
					<td></td>
				</tr>
			</table>

			@else
			<div class="alert alert-info"><strong>Hello!</strong><br /> Add your categories to get started using Nickelpinch. For help <a href="#">click here</a>.</div>
			@endif
		</div>
	</div>

	@include('budget.category_create')
	@include('budget.monthly_reset')


</div>

@stop