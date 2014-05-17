@extends('home.base')

@section('content')
<div class="container">
	<div class="row">
		<div class="col-xs-10 col-xs-offset-1 col-sm-5 col-sm-offset-1 col-md-3 col-md-offset-2">
			<div class="panel panel-default">
				<div class="panel-heading">
					<h3 class="panel-title">Overview</h3>
            	</div>
            	<table class="table table-condensed">
	              	<tbody>
	              		@foreach($user_data->user_categories as $cat)
	              		@if($cat->class != 8 && $cat->class != 255)
	              		<tr>
		                	<td>
		                		<a href="#">{{ $cat->category_name }}</a><br>
		                		<span class="label label-success">${{ number_format($cat->balance,2,'.','') }} / ${{ number_format($cat->top_limit,2,'.','') }}</span>
		                		<span class="label label-default"><span class="glyphicon glyphicon-lock"></span> $1500</span>
		                	</td>
		                	<td>
		                		<span class="pull-right"><a class="btn btn-primary"><span class="glyphicon glyphicon-plus"></span></a></span>
		                	</td>
		                </tr>
	              		@endif
	              		@endforeach
		                <tr>
		                	<td>
		                		<a href="#">Rent</a><br>
		                		<span class="label label-success">$0 / $1500</span> <span class="label label-default"><span class="glyphicon glyphicon-lock"></span> $1500</span>
		                	</td>
		                	<td>
		                		<span class="pull-right"><a class="btn btn-primary"><span class="glyphicon glyphicon-plus"></span></a></span>
		                	</td>
		                </tr>
	               
	              	</tbody>
            	</table>
          	</div>
        </div>

    </div>
</div>

@stop