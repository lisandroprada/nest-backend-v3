import { Controller, Post, Body } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { AssignExpenseDto } from './dto/assign-expense.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { User } from '../user/entities/user.entity';

@Controller('expenses')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('assign')
  assignExpense(@Body() assignDto: AssignExpenseDto, @GetUser() user: User) {
    return this.expensesService.assignExpense(assignDto, user._id.toString());
  }
}
