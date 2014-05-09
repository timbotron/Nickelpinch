$(document).ready(function()
{

	//Budget

	$('.budget-add-buttons button').click(function()
	{
		if($(this).hasClass('cc-btn'))
		{
			// update form
			$('form legend').html('Add a Credit Card');
			$('form label[for="category_name"]').html('Credit Card Name');
			$('form input[name="category_name"]').attr('placeholder','Enter Credit Card Name');
			$('.if-cc').show();
			$('form input[type="submit"]').val('Create Credit Card');
			$(this).attr('disabled',true).addClass('btn-default').removeClass('btn-primary');
			$('.cat-btn').attr('disabled',false).removeClass('btn-default').addClass('btn-primary');
		}
		else
		{
			// update form
			$('form legend').html('Add a Category');
			$('form label[for="category_name"]').html('Category Name');
			$('form input[name="category_name"]').attr('placeholder','Enter Category Name');
			$('.if-cc').hide();
			$('form input[type="submit"]').val('Create Category');
			$(this).attr('disabled',true).addClass('btn-default').removeClass('btn-primary');
			$('.cc-btn').attr('disabled',false).removeClass('btn-default').addClass('btn-primary');
		}


		console.log($current);
	});
});