
-- Function to update stock when a parts order is delivered
CREATE OR REPLACE FUNCTION public.update_stock_from_parts_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _item RECORD;
BEGIN
  -- Only trigger when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    -- Get all items from this order
    FOR _item IN
      SELECT part_name, part_number, quantity, unit_price
      FROM public.parts_order_items
      WHERE order_id = NEW.id
    LOOP
      -- Try to find existing part in shop's stock by name or reference
      DECLARE
        _part_id uuid;
      BEGIN
        SELECT id INTO _part_id
        FROM public.parts
        WHERE shop_id = NEW.shop_id
          AND (
            (reference IS NOT NULL AND reference = _item.part_number AND _item.part_number != '')
            OR (lower(name) = lower(_item.part_name))
          )
        LIMIT 1;

        IF _part_id IS NOT NULL THEN
          -- Update existing part stock
          UPDATE public.parts
          SET stock_quantity = stock_quantity + _item.quantity
          WHERE id = _part_id;

          -- Record stock movement
          INSERT INTO public.stock_movements (shop_id, part_id, type, quantity, reason)
          VALUES (NEW.shop_id, _part_id, 'in', _item.quantity, 'Entrega pedido fornecedor #' || NEW.id::text);
        ELSE
          -- Create new part in stock
          INSERT INTO public.parts (shop_id, name, reference, internal_cost, sale_price, stock_quantity, min_stock, active)
          VALUES (NEW.shop_id, _item.part_name, NULLIF(_item.part_number, ''), _item.unit_price, _item.unit_price * 1.3, _item.quantity, 2, true)
          RETURNING id INTO _part_id;

          INSERT INTO public.stock_movements (shop_id, part_id, type, quantity, reason)
          VALUES (NEW.shop_id, _part_id, 'in', _item.quantity, 'Novo stock via pedido fornecedor');
        END IF;
      END;
    END LOOP;

    -- Update delivered_at
    NEW.delivered_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on parts_orders for auto stock update
CREATE TRIGGER trg_parts_order_delivered
  BEFORE UPDATE ON public.parts_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_from_parts_order();
