@extends('home.base')

@section('content')
<div class="container">
	<div class="row">
		<div class="col-sm-6 col-sm-offset-3 col-md-4 col-md-offset-4">
			Budget!
		</div>

	@include('app.category_create')

	</div>

</div>

@stop