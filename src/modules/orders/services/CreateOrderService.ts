import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Could nor find any customer with the given id');
    }

    const existsProducts = await this.productsRepository.findAllById(products);

    if (!existsProducts.length) {
      throw new AppError('Cold not find any product with the given ids');
    }

    const existsProductsIds = existsProducts.map(product => product.id);

    const ckeckInexistentProduct = products.filter(
      product => !existsProductsIds.includes(product.id),
    );

    if (ckeckInexistentProduct.length) {
      throw new AppError(
        `Could not find product ${ckeckInexistentProduct[0].id}`,
      );
    }

    const findProductsWithNoQuantityAvailable = products.filter(
      product =>
        existsProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithNoQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductsWithNoQuantityAvailable[0].quantity} is not available for ${findProductsWithNoQuantityAvailable[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existsProducts.filter(p => p.id === product.id)[0].price,
    }));

    // console.log(serializedProducts);

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    // console.log(order);

    const orderedProductQuantity = products.map(product => ({
      id: product.id,
      quantity:
        existsProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductQuantity);

    return order;
  }
}

export default CreateOrderService;
