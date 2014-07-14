$(document).ready(function()
{

	// Entry Add

	if($('.entry-add').length)
	{
		$('.using-manual-date').click(function()
		{
			if(this.checked)
			{
				$('.date-dd').hide();
				$('.date-txt').show();
			}
			else
			{
				$('.date-dd').show();
				$('.date-txt').hide();
			}

		});
		$('.using-multi-cats').click(function()
		{
			if(this.checked)
			{
				$('.multi-cats').show();
			}
			else
			{
				$('.multi-cats').hide();
			}

		});
	}

	//Budget

	$('.filter-budget input').click(function()
	{
		$('tr').hide();

		$('.filter-budget input:checked').each(function()
		{
			$('tr.'+$(this).val()).show();
		});
	});

	if($('.budget-edit-view').length)
	{
		// hit appropriate class button for good labels/text
		
	}

	$('.budget-add-buttons button').click(function()
	{
		if($('.budget-view').length)
		{
			if($(this).hasClass('cc-btn'))
			{
				// update form
				$('form legend').html('Add a Credit Card');
				$('form label[for="category_name"]').html('Credit Card Name');
				$('form label[for="top_limit"]').html('Credit Card Limit');
				$('form input[name="category_name"]').attr('placeholder','Enter Credit Card Name');
				$('.if-cc').show();
				$('form input[type="submit"]').val('Create Credit Card');
				$('form input[name="class"]').val('credit_card');
			}
			else if($(this).hasClass('cat-btn'))
			{
				// update form
				$('form legend').html('Add a Category');
				$('form label[for="category_name"]').html('Category Name');
				$('form label[for="top_limit"]').html('Monthly Spending Limit');
				$('form input[name="category_name"]').attr('placeholder','Enter Category Name');
				$('form input[name="class"]').val('standard');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Create Category');
			}
			else if($(this).hasClass('sav-btn'))
			{
				// update form
				$('form legend').html('Add a Savings Category');
				$('form label[for="category_name"]').html('Savings Category Name');
				$('form label[for="top_limit"]').html('Monthly Savings Goal');
				$('form input[name="category_name"]').attr('placeholder','Enter Savings Category Name');
				$('form input[name="class"]').val('savings');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Create Savings Category');
			}
			else if($(this).hasClass('exsav-btn'))
			{
				// update form
				$('form legend').html('Add an External Savings Category');
				$('form label[for="category_name"]').html('Savings Category Name');
				$('form label[for="top_limit"]').html('Monthly Savings Goal');
				$('form input[name="category_name"]').attr('placeholder','Enter Savings Category Name');
				$('form input[name="class"]').val('ext_savings');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Create External Savings Category');
			}
		}
		else if($('.budget-edit-view').length)
		{
			if($(this).hasClass('cc-btn'))
			{
				// update form
				$('form legend').html('Update Credit Card');
				$('form label[for="category_name"]').html('Credit Card Name');
				$('form label[for="top_limit"]').html('Credit Card Limit');
				$('form input[name="category_name"]').attr('placeholder','Enter Credit Card Name');
				$('.if-cc').show();
				$('form input[type="submit"]').val('Update Credit Card');
				$('form input[name="class"]').val('credit_card');
			}
			else if($(this).hasClass('cat-btn'))
			{
				// update form
				$('form legend').html('Update Category');
				$('form label[for="category_name"]').html('Category Name');
				$('form label[for="top_limit"]').html('Monthly Spending Limit');
				$('form input[name="category_name"]').attr('placeholder','Enter Category Name');
				$('form input[name="class"]').val('standard');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Update Category');
			}
			else if($(this).hasClass('sav-btn'))
			{
				// update form
				$('form legend').html('Update Savings Category');
				$('form label[for="category_name"]').html('Savings Category Name');
				$('form label[for="top_limit"]').html('Monthly Savings Goal');
				$('form input[name="category_name"]').attr('placeholder','Enter Savings Category Name');
				$('form input[name="class"]').val('savings');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Update Savings Category');
			}
			else if($(this).hasClass('exsav-btn'))
			{
				// update form
				$('form legend').html('Update External Savings Category');
				$('form label[for="category_name"]').html('Savings Category Name');
				$('form label[for="top_limit"]').html('Monthly Savings Goal');
				$('form input[name="category_name"]').attr('placeholder','Enter Savings Category Name');
				$('form input[name="class"]').val('savings');
				$('.if-cc').hide();
				$('form input[type="submit"]').val('Update External Savings Category');
			}
		}
		
		$('.budget-add-buttons button').attr('disabled',false).removeClass('btn-primary').addClass('btn-default');
		$(this).attr('disabled',true).addClass('btn-primary').removeClass('btn-default');

	});
});