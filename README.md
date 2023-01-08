# Node Red Genetic charging scheduler

This is a module for Node-RED that adds a battery charging strategy to [node-red-contrib-power-saver](https://powersaver.no). It uses genetic algorithms to find the best schedule


The node can be installed from the palette in node-red:
![image](https://user-images.githubusercontent.com/123237/211203809-f9aca2d6-94be-42f4-b6db-42da6aac8830.png)



The "strategy-genetic-charging-node" should be fed with the output of the [ps-receive-price](https://powersaver.no/nodes/ps-receive-price.html#description)  from the [Power Saver project](https://powersaver.no/).


This node is configured by providing it with:
- the capacity of your home battery(kWh)
- the max input power(kWh)
- you average consumption per hour:

![image](https://user-images.githubusercontent.com/123237/211203544-c3a79121-2b6c-4d1f-9f01-8be8774f0d9a.png)

The genetic algorithm have some properties that also can be elaborated with if you want.
