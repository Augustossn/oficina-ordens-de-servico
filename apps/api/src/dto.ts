import { IsString, IsEmail, IsOptional, IsInt, Min, Max, IsEnum, Length, Matches } from 'class-validator';
import { Status } from '@prisma/client';
export class LoginDto {
 @IsEmail() email!: string;
 @IsString() @Length(8,128) password!: string;
}
export class CustomerDto {
 @IsString() @Length(2,120) name!: string;
 @IsOptional() @IsEmail() email?: string;
 @IsString() @Length(8,30) phone!: string;
 @Matches(/^\d{8}$/) zip!: string;
 @IsString() @Length(3,300) address!: string;
}
export class OrderDto {
 @IsString() @Length(3,160) title!: string;
 @IsString() @Length(3,10000) description!: string;
 @IsString() customerId!: string;
 @IsOptional() @IsString() technicianId?: string;
}
export class UpdateOrderDto extends OrderDto {
 @IsInt() @Min(1) version!: number;
}
export class StatusDto {
 @IsEnum(Status) status!: Status;
 @IsInt() @Min(1) version!: number;
}
export class ListDto {
 @IsOptional() @IsEnum(Status) status?: Status;
 @IsOptional() @IsString() @Length(0,100) q?: string;
 @IsOptional() @Matches(/^[1-9]\d{0,5}$/) page?: string;
}
export class WebhookDto extends StatusDto {
 @IsString() @Length(1,100) orderId!: string;
}export class UserDto {
 @IsString() @Length(2,120) name!: string;
 @IsEmail() email!: string;
 @IsString() @Length(8,128) password!: string;
 @IsEnum({MANAGER:'MANAGER',TECHNICIAN:'TECHNICIAN'}) role!: 'MANAGER'|'TECHNICIAN';
}
